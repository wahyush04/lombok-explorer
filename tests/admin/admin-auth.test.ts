import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Authentication & Authorization Suite (Phase 1 & 2)', () => {
  let app: Application;
  let adminAccessToken = '';
  let adminRefreshToken = '';
  let userAccessToken = '';
  let userRefreshToken = '';

  beforeAll(async () => {
    app = createApp();

    // Login with regular user to obtain user tokens
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userAccessToken = userRes.body.data.accessToken;
    userRefreshToken = userRes.body.data.refreshToken;
  });

  describe('POST /api/v1/admin/auth/login', () => {
    it('should successfully authenticate an administrator and return admin tokens', async () => {
      const response = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'admin@lombokexplorer.com',
        password: 'Password123!',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('email', 'admin@lombokexplorer.com');
      expect(response.body.data.user).toHaveProperty('role', 'ADMIN');
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data.user).not.toHaveProperty('refreshToken');

      adminAccessToken = response.body.data.accessToken;
      adminRefreshToken = response.body.data.refreshToken;
    });

    it('should reject standard non-admin users with 403 Forbidden', async () => {
      const response = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'traveler@lombokexplorer.com',
        password: 'Password123!',
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
      expect(response.body.message).toBe('Admin access required');
    });

    it('should return 401 Unauthorized for incorrect password', async () => {
      const response = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'admin@lombokexplorer.com',
        password: 'WrongPassword!',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 Unauthorized for non-existent admin email', async () => {
      const response = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'nonexistent_admin@lombokexplorer.com',
        password: 'Password123!',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('should return 400 Bad Request for invalid email format', async () => {
      const response = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'invalid-email-format',
        password: 'Password123!',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/admin/auth/refresh', () => {
    it('should refresh access token using valid admin refresh token', async () => {
      const response = await request(app).post('/api/v1/admin/auth/refresh').send({
        refreshToken: adminRefreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.role).toBe('ADMIN');

      // Update active tokens
      adminAccessToken = response.body.data.accessToken;
      adminRefreshToken = response.body.data.refreshToken;
    });

    it('should reject refresh attempt using regular user refresh token', async () => {
      const response = await request(app).post('/api/v1/admin/auth/refresh').send({
        refreshToken: userRefreshToken,
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return 401 for invalid or corrupted refresh token', async () => {
      const response = await request(app).post('/api/v1/admin/auth/refresh').send({
        refreshToken: 'invalid_refresh_token_string',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('GET /api/v1/admin/auth/me', () => {
    it('should return admin profile when authenticated with admin token', async () => {
      const response = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('email', 'admin@lombokexplorer.com');
      expect(response.body.data).toHaveProperty('role', 'ADMIN');
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should return 403 Forbidden when accessed with standard user token', async () => {
      const response = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return 401 Unauthorized when accessed without token', async () => {
      const response = await request(app).get('/api/v1/admin/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });
  });

  describe('POST /api/v1/admin/auth/logout', () => {
    it('should revoke admin refresh token on logout', async () => {
      const response = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('Admin OpenAPI Documentation Endpoints', () => {
    it('GET /api/docs/admin/json should return valid OpenAPI spec for Admin API', async () => {
      const response = await request(app).get('/api/docs/admin/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('openapi', '3.0.3');
      expect(response.body.info).toHaveProperty('title', 'Lombok Explorer Admin API');
      expect(response.body.paths).toHaveProperty('/auth/login');
      expect(response.body.paths).toHaveProperty('/auth/refresh');
      expect(response.body.paths).toHaveProperty('/auth/logout');
      expect(response.body.paths).toHaveProperty('/auth/me');
    });

    it('GET /api/docs/admin/yaml should return YAML text for Admin API', async () => {
      const response = await request(app).get('/api/docs/admin/yaml');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Lombok Explorer Admin API');
      expect(response.text).toContain('/auth/login');
    });
  });
});
