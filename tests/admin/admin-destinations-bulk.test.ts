import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Destinations Bulk Operations API Suite (Phase 12)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let testCategoryId = '';
  let testDestId1 = '';
  let testDestId2 = '';
  let testDestId3 = '';
  let disposableDestId1 = '';
  let disposableDestId2 = '';

  const testSuffix = Date.now();

  beforeAll(async () => {
    app = createApp();

    // 1. Login Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Register regular user for auth tests
    const userRes = await request(app).post('/api/v1/auth/register').send({
      username: `bulk_tester_${testSuffix.toString().slice(-4)}`,
      name: `Bulk Tester ${testSuffix}`,
      email: `bulk.tester.${testSuffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // 3. Create test Category
    const catRes = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Bulk Test Category ${testSuffix}`,
        description: 'Test Category for Bulk Operations testing',
        iconName: 'layers',
      });
    testCategoryId = catRes.body.data.id;

    // 4. Create 3 test destinations for bulk status and soft delete
    const d1 = await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Bulk Dest 1 ${testSuffix}`,
        description: 'Destination 1 for bulk operations testing in Lombok.',
        categoryId: testCategoryId,
        region: 'LOMBOK_SELATAN',
        locationName: 'South Lombok',
        latitude: -8.8951,
        longitude: 116.2951,
      });
    testDestId1 = d1.body.data.id;

    const d2 = await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Bulk Dest 2 ${testSuffix}`,
        description: 'Destination 2 for bulk operations testing in Lombok.',
        categoryId: testCategoryId,
        region: 'LOMBOK_SELATAN',
        locationName: 'South Lombok',
        latitude: -8.8952,
        longitude: 116.2952,
      });
    testDestId2 = d2.body.data.id;

    const d3 = await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Bulk Dest 3 ${testSuffix}`,
        description: 'Destination 3 for bulk operations testing in Lombok.',
        categoryId: testCategoryId,
        region: 'LOMBOK_SELATAN',
        locationName: 'South Lombok',
        latitude: -8.8953,
        longitude: 116.2953,
      });
    testDestId3 = d3.body.data.id;

    // 5. Create 2 disposable destinations for hard bulk delete
    const disp1 = await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Disposable Bulk Dest 1 ${testSuffix}`,
        description: 'Disposable destination 1 for hard bulk delete.',
        categoryId: testCategoryId,
        region: 'LOMBOK_BARAT',
        locationName: 'West Lombok',
        latitude: -8.5831,
        longitude: 116.0831,
      });
    disposableDestId1 = disp1.body.data.id;

    const disp2 = await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Disposable Bulk Dest 2 ${testSuffix}`,
        description: 'Disposable destination 2 for hard bulk delete.',
        categoryId: testCategoryId,
        region: 'LOMBOK_BARAT',
        locationName: 'West Lombok',
        latitude: -8.5832,
        longitude: 116.0832,
      });
    disposableDestId2 = disp2.body.data.id;
  });

  describe('POST /api/v1/admin/destinations/bulk-status', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .send({ ids: [testDestId1, testDestId2], status: 'DRAFT' });

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin users with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [testDestId1, testDestId2], status: 'DRAFT' });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should reject request with empty ids array (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [], status: 'DRAFT' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject request with invalid status value (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [testDestId1], status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if any destination ID does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [testDestId1, 'non_existent_id_xyz'], status: 'DRAFT' });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATIONS_NOT_FOUND');
    });

    it('should update multiple destinations to DRAFT atomically (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [testDestId1, testDestId2, testDestId3], status: 'DRAFT' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(3);
      expect(res.body.data.status).toBe('DRAFT');

      // Verify destination 1
      const check1 = await request(app)
        .get(`/api/v1/admin/destinations/${testDestId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check1.body.data.status).toBe('DRAFT');

      // Verify destination 2
      const check2 = await request(app)
        .get(`/api/v1/admin/destinations/${testDestId2}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check2.body.data.status).toBe('DRAFT');
    });

    it('should update multiple destinations to ARCHIVED atomically and set deletedAt (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [testDestId1, testDestId2], status: 'ARCHIVED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);
      expect(res.body.data.status).toBe('ARCHIVED');

      const check1 = await request(app)
        .get(`/api/v1/admin/destinations/${testDestId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check1.body.data.status).toBe('ARCHIVED');
      expect(check1.body.data.deletedAt).not.toBeNull();
    });

    it('should restore multiple destinations to PUBLISHED atomically and clear deletedAt (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [testDestId1, testDestId2, testDestId3], status: 'PUBLISHED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(3);
      expect(res.body.data.status).toBe('PUBLISHED');

      const check1 = await request(app)
        .get(`/api/v1/admin/destinations/${testDestId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check1.body.data.status).toBe('PUBLISHED');
      expect(check1.body.data.deletedAt).toBeNull();
    });
  });

  describe('POST /api/v1/admin/destinations/bulk-delete', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-delete')
        .send({ ids: [testDestId1] });

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin users with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-delete')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [testDestId1] });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should reject empty ids array with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if any destination ID does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: ['non_existent_dest_id_123'] });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATIONS_NOT_FOUND');
    });

    it('should soft-delete multiple destinations by default (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [testDestId1, testDestId2] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);
      expect(res.body.data.hard).toBe(false);

      const check1 = await request(app)
        .get(`/api/v1/admin/destinations/${testDestId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check1.body.data.status).toBe('ARCHIVED');
      expect(check1.body.data.deletedAt).not.toBeNull();
    });

    it('should permanently hard-delete destinations when hard: true (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations/bulk-delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [disposableDestId1, disposableDestId2], hard: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);
      expect(res.body.data.hard).toBe(true);

      // Verify they are completely removed from DB
      const check1 = await request(app)
        .get(`/api/v1/admin/destinations/${disposableDestId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check1.status).toBe(404);

      const check2 = await request(app)
        .get(`/api/v1/admin/destinations/${disposableDestId2}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check2.status).toBe(404);
    });
  });
});
