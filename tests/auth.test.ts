import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Application, Request, Response } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { authenticate, authorize } from '../src/common/middleware/auth.middleware';
import { errorHandlerMiddleware } from '../src/common/middleware/error.middleware';

describe('Authentication & Authorization Module (Phase 7)', () => {
  let app: Application;
  let rbacApp: Application;

  const testUser = {
    username: `siti_rahma_${Date.now().toString().slice(-6)}`,
    name: 'Siti Rahmawati',
    email: `siti.rahma.${Date.now()}@lombokexplorer.com`,
    password: 'PasswordRahasia123!',
    travelStyle: 'BEACH_RELAXATION',
    preferredRegion: 'LOMBOK_SELATAN',
  };

  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    app = createApp();

    // Dedicated mini-app to test RBAC authorize middleware
    rbacApp = express();
    rbacApp.use(express.json());
    rbacApp.get('/test-admin-only', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Welcome Admin!' });
    });
    rbacApp.get('/test-user-or-admin', authenticate, authorize('USER', 'ADMIN'), (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Welcome User/Admin!' });
    });
    rbacApp.use(errorHandlerMiddleware);
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user successfully with hashed password and return JWT tokens', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('registered successfully');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.tokenType).toBe('Bearer');
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.user.username).toBe(testUser.username.toLowerCase());
      expect(response.body.data.user.role).toBe('USER');
      expect(response.body.data.user).not.toHaveProperty('password');

      // Verify in DB that password is NEVER stored in plaintext
      const dbUser = await prisma.user.findUnique({
        where: { email: testUser.email.toLowerCase() },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser?.password).not.toBe(testUser.password);
      expect(dbUser?.password.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    it('should reject registration if email is already in use (409 Conflict)', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration with invalid payload (400 Validation Error)', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          name: 'A',
          email: 'not-an-email',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.details.length).toBeGreaterThan(0);
    });
  });

  describe('POST /v1/auth/login', () => {
    it('should authenticate user with valid credentials and return JWT tokens', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());

      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should reject login with wrong password (401 Unauthorized)', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email (401 Unauthorized)', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: 'unknown.user@lombokexplorer.com',
          password: 'SomePassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return profile for authenticated user with valid Bearer token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('refreshToken');
    });

    it('should reject request without Authorization header (401 Unauthorized)', async () => {
      const response = await request(app).get('/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject request with invalid JWT token (401 Unauthorized)', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token.string');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /v1/auth/refresh (Token Rotation)', () => {
    it('should rotate tokens and return a new access & refresh token pair', async () => {
      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // The new refresh token should be distinct or valid
      const newAccessToken = response.body.data.accessToken;
      const newRefreshToken = response.body.data.refreshToken;

      // Verify the new access token can be used to query /auth/me
      const meResponse = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.email).toBe(testUser.email.toLowerCase());

      // Update active tokens
      accessToken = newAccessToken;
      refreshToken = newRefreshToken;
    });

    it('should reject refresh with an invalid or malformed refresh token (401 Unauthorized)', async () => {
      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid-expired-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Role-based Authorization Middleware (authorize)', () => {
    it('should deny regular USER access to ADMIN-only endpoint (403 Forbidden)', async () => {
      const response = await request(rbacApp)
        .get('/test-admin-only')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should allow regular USER access to endpoint permitted for USER', async () => {
      const response = await request(rbacApp)
        .get('/test-user-or-admin')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should invalidate refresh token on logout', async () => {
      const response = await request(app)
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out successfully');

      // Verify old refresh token can no longer be used
      const refreshResponse = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });
});
