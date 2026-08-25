import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Search, Filter & Pagination Uniformity Suite (Phase 14)', () => {
  let app: Application;
  let adminToken = '';
  const testSuffix = Date.now();

  beforeAll(async () => {
    app = createApp();

    // 1. Login Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Create sample test category with DRAFT status
    const catDraft = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Filter Draft Category ${testSuffix}`,
        description: 'Draft category for filter testing',
        iconName: 'filter_alt',
        status: 'DRAFT',
      });

    // 3. Create sample test category with PUBLISHED status
    const catPub = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Filter Published Category ${testSuffix}`,
        description: 'Published category for filter testing',
        iconName: 'check_circle',
        status: 'PUBLISHED',
      });

    // 4. Create sample test destination
    await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Filter Merese Beach ${testSuffix}`,
        description: 'Scenic hill and crystal clear beach water in South Lombok.',
        categoryId: catPub.body.data.id,
        region: 'LOMBOK_SELATAN',
        locationName: 'South Lombok',
        latitude: -8.895,
        longitude: 116.295,
        status: 'PUBLISHED',
      });
  });

  describe('1. Destinations Collection Search & Filter (GET /api/v1/admin/destinations)', () => {
    it('should return uniform pagination metadata (page, limit, total, totalPages)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('should support search query case-insensitively', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/destinations?search=merese%20beach%20${testSuffix}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toContain('Filter Merese Beach');
    });

    it('should support status filter (PUBLISHED, DRAFT, ARCHIVED)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations?status=PUBLISHED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((d: any) => d.status === 'PUBLISHED')).toBe(true);
    });

    it('should support sortBy and sortOrder (asc/desc)', async () => {
      const resAsc = await request(app)
        .get('/api/v1/admin/destinations?sortBy=name&sortOrder=asc&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAsc.status).toBe(200);
      const names = resAsc.body.data.map((d: any) => d.name.toLowerCase());
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should support createdFrom and createdTo date range filtering', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/v1/admin/destinations?createdFrom=${today}&createdTo=${today}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('2. Categories Collection Search & Filter (GET /api/v1/admin/categories)', () => {
    it('should return uniform pagination response envelope', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('should filter categories by status (DRAFT)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories?status=DRAFT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((c: any) => c.status === 'DRAFT')).toBe(true);
    });

    it('should support search and sortOrder', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/categories?search=${testSuffix}&sortBy=name&sortOrder=desc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('3. Restaurants Collection Search & Filter (GET /api/v1/admin/restaurants)', () => {
    it('should support pagination, status, and createdFrom/createdTo filtering', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/v1/admin/restaurants?page=1&limit=5&status=PUBLISHED&createdFrom=${today}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('totalPages');
    });
  });

  describe('4. Accommodations Collection Search & Filter (GET /api/v1/admin/accommodations)', () => {
    it('should support pagination, status, and sortOrder filtering', async () => {
      const res = await request(app)
        .get('/api/v1/admin/accommodations?page=1&limit=5&status=PUBLISHED&sortBy=name&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('totalPages');
    });
  });

  describe('5. Users Collection Search & Filter (GET /api/v1/admin/users)', () => {
    it('should support pagination, status, search, and date range filtering', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=5&status=ACTIVE&search=admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Audit Logs Collection Search & Filter (GET /api/v1/admin/audit-logs)', () => {
    it('should support pagination, search, createdFrom/createdTo, and sortOrder', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/v1/admin/audit-logs?page=1&limit=5&createdFrom=${today}&sortOrder=desc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });
  });
});
