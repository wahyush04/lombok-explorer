import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Master Testing & Quality Assurance Suite (Phase 19)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let suspendedAdminEmail = '';
  const testSuffix = Date.now();

  beforeAll(async () => {
    app = createApp();

    // 1. Authenticate Legitimate Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Register Standard Traveler User (role: USER)
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: `Standard Traveler ${testSuffix}`,
      email: `traveler_${testSuffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // 3. Register another account, promote to ADMIN, and suspend via Admin API
    suspendedAdminEmail = `suspended_admin_${testSuffix}@lombokexplorer.com`;
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Suspended Admin',
      email: suspendedAdminEmail,
      password: 'Password123!',
    });
    const suspendedUserId = regRes.body.data.user.id;

    // Promote to ADMIN
    await request(app)
      .put(`/api/v1/admin/users/${suspendedUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });

    // Suspend user
    await request(app)
      .patch(`/api/v1/admin/users/${suspendedUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' });
  });

  describe('1. Authentication Verification', () => {
    it('should successfully login an administrator and return tokens', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'admin@lombokexplorer.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('should reject normal USER login attempt to admin portal with 403 Forbidden', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'traveler@lombokexplorer.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should reject invalid / incorrect password with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        email: 'admin@lombokexplorer.com',
        password: 'WrongPassword999!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('should reject inactive / suspended admin account with 401/403', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        email: suspendedAdminEmail,
        password: 'Password123!',
      });

      expect([401, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject forged / invalid JWT token on protected admin endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', 'Bearer invalid.fake.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_TOKEN');
    });
  });

  describe('2. Authorization Verification', () => {
    it('should reject unauthenticated request with 401 (TOKEN_MISSING)', async () => {
      const res = await request(app).get('/api/v1/admin/users');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject standard USER role with 403 (ADMIN_ACCESS_REQUIRED)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should allow authentic ADMIN role access (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('3. CRUD Matrix Verification (Create, Read, Update, Delete, Validation, Not Found, Conflict)', () => {
    let createdCatId = '';
    let createdDestId = '';
    const categoryName = `Master Test Cat ${testSuffix}`;

    // A. Validation Error (Create with invalid payload)
    it('Validation: should reject Create Category with 400 when name is empty', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          description: 'Too short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    // B. Create
    it('Create: should create a new category successfully (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: categoryName,
          description: 'Testing master testing suite category lifecycle',
          iconName: 'category',
          status: 'PUBLISHED',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(categoryName);
      createdCatId = res.body.data.id;
    });

    // C. Conflict Error
    it('Conflict: should reject duplicate category creation with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: categoryName,
          description: 'Duplicate category test',
          iconName: 'category',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('CATEGORY_NAME_EXISTS');
    });

    // D. Read (List & Detail)
    it('Read: should read category details by ID (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/categories/${createdCatId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdCatId);
    });

    // E. Not Found Error
    it('Not Found: should return 404 when querying non-existent category', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories/non-existent-cat-uuid-999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('CATEGORY_NOT_FOUND');
    });

    // F. Update
    it('Update: should update category details (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/categories/${createdCatId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated master description for category',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated master description for category');
    });

    // G. Create Destination under Category
    it('Create Destination: should create destination under category (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Master Test Dest ${testSuffix}`,
          description: 'Master destination for end-to-end CRUD suite test',
          categoryId: createdCatId,
          region: 'LOMBOK_SELATAN',
          locationName: 'Pujut, Central Lombok',
          latitude: -8.89,
          longitude: 116.29,
          status: 'PUBLISHED',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdDestId = res.body.data.id;
    });

    // H. Delete
    it('Delete: should delete destination and category (200 OK)', async () => {
      // 1. Delete destination first (hard delete to clear category foreign reference)
      const destDeleteRes = await request(app)
        .delete(`/api/v1/admin/destinations/${createdDestId}?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(destDeleteRes.status).toBe(200);

      // 2. Delete category
      const catDeleteRes = await request(app)
        .delete(`/api/v1/admin/categories/${createdCatId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(catDeleteRes.status).toBe(200);
    });
  });

  describe('4. Comprehensive Admin Security Boundary (/api/v1/admin/*)', () => {
    const adminRoutesToProbe = [
      '/api/v1/admin/auth/me',
      '/api/v1/admin/dashboard',
      '/api/v1/admin/destinations',
      '/api/v1/admin/categories',
      '/api/v1/admin/restaurants',
      '/api/v1/admin/accommodations',
      '/api/v1/admin/users',
      '/api/v1/admin/reviews',
      '/api/v1/admin/audit-logs',
    ];

    for (const route of adminRoutesToProbe) {
      it(`should strictly deny standard traveler user from accessing ${route}`, async () => {
        const res = await request(app)
          .get(route)
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
      });
    }
  });

  describe('5. Audit Trail Verification', () => {
    it('should generate audit log records when admin performs mutations', async () => {
      const logsRes = await request(app)
        .get('/api/v1/admin/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.success).toBe(true);
      expect(logsRes.body.data.length).toBeGreaterThan(0);

      const firstLog = logsRes.body.data[0];
      expect(firstLog).toHaveProperty('id');
      expect(firstLog).toHaveProperty('action');
      expect(firstLog).toHaveProperty('entity');
      expect(firstLog).toHaveProperty('createdAt');
    });
  });
});
