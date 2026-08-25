import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin User Management API Suite (Phase 9)', () => {
  let app: Application;
  let adminToken = '';
  let adminUserId = '';
  let userToken = '';
  let targetUserId = '';
  let disposableUserId = '';
  const testSuffix = Date.now();
  const testEmail1 = `managed.user.${testSuffix}@lombokexplorer.com`;
  const testEmail2 = `disposable.user.${testSuffix}@lombokexplorer.com`;

  beforeAll(async () => {
    app = createApp();

    // 1. Login Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;
    adminUserId = adminRes.body.data.user.id;

    // 2. Register Target User for testing
    const targetRes = await request(app).post('/api/v1/auth/register').send({
      name: `Target User ${testSuffix}`,
      email: testEmail1,
      password: 'Password123!',
    });
    targetUserId = targetRes.body.data.user.id;
    userToken = targetRes.body.data.accessToken;

    // 3. Register Disposable User for deletion testing
    const dispRes = await request(app).post('/api/v1/auth/register').send({
      name: `Disposable User ${testSuffix}`,
      email: testEmail2,
      password: 'Password123!',
    });
    disposableUserId = dispRes.body.data.user.id;
  });

  describe('GET /api/v1/admin/users (List & Filter Users)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return paginated users for admin without exposing passwords', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);

      const firstUser = res.body.data[0];
      expect(firstUser).toHaveProperty('id');
      expect(firstUser).toHaveProperty('email');
      expect(firstUser).toHaveProperty('name');
      expect(firstUser).toHaveProperty('role');
      expect(firstUser).toHaveProperty('status');
      expect(firstUser).not.toHaveProperty('password');
      expect(firstUser).not.toHaveProperty('refreshToken');
    });

    it('should filter users by search keyword and role', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users?search=${testEmail1}&role=USER`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((u: any) => u.email === testEmail1)).toBe(true);
    });

    it('should filter users by status ACTIVE', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((u: any) => u.status === 'ACTIVE')).toBe(true);
    });
  });

  describe('GET /api/v1/admin/users/:id (Get User Details)', () => {
    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/invalid_user_id_xyz')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('USER_NOT_FOUND');
    });

    it('should return user details with statistics and without password', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(targetUserId);
      expect(res.body.data.email).toBe(testEmail1);
      expect(res.body.data).toHaveProperty('stats');
      expect(res.body.data.stats).toHaveProperty('favoritesCount');
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('refreshToken');
    });
  });

  describe('PUT /api/v1/admin/users/:id (Update User Profile & Role)', () => {
    it('should update user name, phone, and travel style successfully (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Updated Target User ${testSuffix}`,
          phone: '+6281987654321',
          travelStyle: 'NATURE_ADVENTURE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(`Updated Target User ${testSuffix}`);
      expect(res.body.data.phone).toBe('+6281987654321');
      expect(res.body.data.travelStyle).toBe('NATURE_ADVENTURE');
    });

    it('should prevent admin from demoting own admin role (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'USER',
        });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('CANNOT_CHANGE_OWN_ROLE');
    });
  });

  describe('PATCH /api/v1/admin/users/:id/status (User Status Transition)', () => {
    it('should suspend user account successfully (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'SUSPENDED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUSPENDED');
    });

    it('should reject login attempt by suspended user (403 Forbidden)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testEmail1,
        password: 'Password123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('ACCOUNT_SUSPENDED');
    });

    it('should reactivate user account successfully (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ACTIVE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');

      // Verify reactivated user can login again
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: testEmail1,
        password: 'Password123!',
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should prevent admin from suspending own account (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'SUSPENDED',
        });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('CANNOT_DEACTIVATE_SELF');
    });
  });

  describe('DELETE /api/v1/admin/users/:id (Delete User)', () => {
    it('should prevent admin from deleting own account (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('CANNOT_DELETE_SELF');
    });

    it('should soft-delete user by default (status becomes INACTIVE)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User deleted successfully');

      // Verify status is INACTIVE and deletedAt is not null
      const checkRes = await request(app)
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.status).toBe('INACTIVE');
      expect(checkRes.body.data.deletedAt).not.toBeNull();
    });

    it('should hard-delete user when ?hard=true is provided', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${disposableUserId}?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify user record is completely removed from DB
      const checkRes = await request(app)
        .get(`/api/v1/admin/users/${disposableUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(404);
    });
  });
});
