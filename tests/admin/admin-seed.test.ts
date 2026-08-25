import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';
import { config } from '../../src/config/config';

describe('Development Admin Account Seeding (Phase 24)', () => {
  let app: Application;
  const devAdminEmail = config.adminSeed.email;
  const devAdminPassword = config.adminSeed.password;

  beforeAll(() => {
    app = createApp();
  });

  describe('1. Authentication with Seeded Development Admin Account', () => {
    it('should successfully authenticate with configured environment dev admin credentials', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        email: devAdminEmail,
        password: devAdminPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', devAdminEmail.toLowerCase());
      expect(res.body.data.user).toHaveProperty('role', 'ADMIN');
    });

    it('should reject invalid password for seeded dev admin account', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        email: devAdminEmail,
        password: 'WrongPassword999!',
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('errorCode', 'INVALID_CREDENTIALS');
    });

    it('should grant access to admin protected endpoints with dev admin accessToken', async () => {
      const loginRes = await request(app).post('/api/v1/admin/auth/login').send({
        email: devAdminEmail,
        password: devAdminPassword,
      });

      const token = loginRes.body.data.accessToken;

      const dashboardRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(dashboardRes.status).toBe(200);
      expect(dashboardRes.body).toHaveProperty('success', true);
      expect(dashboardRes.body.data).toHaveProperty('overview');
    });
  });
});
