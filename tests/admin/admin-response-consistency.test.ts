import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin API Response Consistency Suite (Phase 21)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  const testSuffix = Date.now();

  beforeAll(async () => {
    app = createApp();

    // 1. Authenticate Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Register Standard User
    const userRes = await request(app).post('/api/v1/auth/register').send({
      username: `consist_${testSuffix.toString().slice(-4)}`,
      name: `Consistency Tester ${testSuffix}`,
      email: `tester_resp_${testSuffix}_${Math.floor(Math.random() * 100000)}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
  });

  describe('1. Success Response Structure ({ success: true, message: string, data: any })', () => {
    it('Single Resource / Object: GET /api/v1/admin/dashboard should return standard success envelope', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
      expect(res.body).toHaveProperty('data');
      expect(typeof res.body.data).toBe('object');
      expect(res.body.data).not.toBeNull();
    });

    it('Created Resource: POST /api/v1/admin/categories should return 201 with standard success envelope', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Consistency Cat ${testSuffix}`,
          description: 'Testing standard response format for 201 Created',
          iconName: 'category',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Category created successfully');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name', `Consistency Cat ${testSuffix}`);
    });

    it('Action Success: DELETE /api/v1/admin/categories/:id should return standard action success envelope', async () => {
      // Create a temporary category to delete
      const createRes = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `To Delete Cat ${testSuffix}`,
          description: 'Category to test action success envelope',
          iconName: 'delete',
        });
      const tempCatId = createRes.body.data.id;

      const delRes = await request(app)
        .delete(`/api/v1/admin/categories/${tempCatId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body).toHaveProperty('success', true);
      expect(delRes.body).toHaveProperty('message');
      expect(typeof delRes.body.message).toBe('string');
    });
  });

  describe('2. Paginated Collection Response Structure ({ success: true, message: string, data: array, meta: object })', () => {
    const paginatedAdminEndpoints = [
      '/api/v1/admin/destinations',
      '/api/v1/admin/categories',
      '/api/v1/admin/restaurants',
      '/api/v1/admin/accommodations',
      '/api/v1/admin/users',
      '/api/v1/admin/reviews',
      '/api/v1/admin/audit-logs',
    ];

    for (const endpoint of paginatedAdminEndpoints) {
      it(`Paginated List: GET ${endpoint} should return data array with meta pagination`, async () => {
        const res = await request(app)
          .get(`${endpoint}?page=1&limit=5`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body).toHaveProperty('meta');
        expect(res.body.meta).toHaveProperty('page', 1);
        expect(res.body.meta).toHaveProperty('limit', 5);
        expect(res.body.meta).toHaveProperty('total');
        expect(res.body.meta).toHaveProperty('totalPages');
        expect(typeof res.body.meta.total).toBe('number');
        expect(typeof res.body.meta.totalPages).toBe('number');
      });
    }
  });

  describe('3. Error Response Structure ({ success: false, message: string, errorCode: string })', () => {
    it('Validation Error (400): should return errorCode VALIDATION_ERROR and success: false', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
          name: '',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });

    it('Authentication Error (401): should return errorCode TOKEN_MISSING and success: false', async () => {
      const res = await request(app).get('/api/v1/admin/destinations');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('errorCode', 'TOKEN_MISSING');
    });

    it('Authorization Error (403): should return errorCode ADMIN_ACCESS_REQUIRED and success: false', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('errorCode', 'ADMIN_ACCESS_REQUIRED');
    });

    it('Not Found Error (404): should return errorCode *_NOT_FOUND and success: false', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations/non-existent-uuid-999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('errorCode', 'DESTINATION_NOT_FOUND');
    });

    it('Conflict Error (409): should return conflict errorCode and success: false', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Consistency Cat ${testSuffix}`,
          description: 'Duplicate category to test 409 conflict',
          iconName: 'category',
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('errorCode', 'CATEGORY_NAME_EXISTS');
    });
  });

  describe('4. Symmetrical Format Contract between Public and Admin APIs', () => {
    it('Public and Admin API should share exact JSON response envelope shape for paginated collections', async () => {
      const publicRes = await request(app).get('/api/v1/destinations?page=1&limit=5');
      const adminRes = await request(app)
        .get('/api/v1/admin/destinations?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(publicRes.status).toBe(200);
      expect(adminRes.status).toBe(200);

      // Both must possess identical envelope keys
      expect(Object.keys(publicRes.body).sort()).toEqual(Object.keys(adminRes.body).sort());
      expect(publicRes.body.success).toBe(true);
      expect(adminRes.body.success).toBe(true);
      expect(publicRes.body).toHaveProperty('meta');
      expect(adminRes.body).toHaveProperty('meta');
    });

    it('Public and Admin API should share exact JSON response envelope shape for single item resources', async () => {
      const publicRes = await request(app).get('/api/v1/destinations/dest_tanjung_aan');
      const adminRes = await request(app)
        .get('/api/v1/admin/destinations/dest_tanjung_aan')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(publicRes.status).toBe(200);
      expect(adminRes.status).toBe(200);

      expect(Object.keys(publicRes.body).sort()).toEqual(Object.keys(adminRes.body).sort());
      expect(publicRes.body.success).toBe(true);
      expect(adminRes.body.success).toBe(true);
    });
  });
});
