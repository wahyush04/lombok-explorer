import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Content Status Transition Suite (Phase 11)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let testDestinationId = '';
  let testCategoryId = '';
  let testRestaurantId = '';
  let testAccommodationId = '';

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
      name: `Status Tester ${testSuffix}`,
      email: `status.tester.${testSuffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // 3. Create test Category
    const catRes = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Status Test Category ${testSuffix}`,
        description: 'Test Category for Status Transition testing',
        iconName: 'sparkles',
      });
    testCategoryId = catRes.body.data.id;

    // 4. Create test Destination
    const destRes = await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Status Test Destination ${testSuffix}`,
        description: 'A beautiful test destination for lifecycle status testing in Lombok.',
        categoryId: testCategoryId,
        region: 'LOMBOK_SELATAN',
        locationName: 'South Lombok',
        latitude: -8.8955,
        longitude: 116.2955,
      });
    testDestinationId = destRes.body.data.id;

    // 5. Create test Restaurant
    const restRes = await request(app)
      .post('/api/v1/admin/restaurants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Status Test Restaurant ${testSuffix}`,
        description: 'Authentic Lombok cuisine for testing status lifecycle transitions.',
        cuisineType: 'Sasak Cuisine',
        specialtyDish: 'Ayam Taliwang Spesial',
        priceRange: '$$',
        address: 'Jl. Raya Kuta No. 1, Lombok',
        region: 'LOMBOK_SELATAN',
        latitude: -8.892,
        longitude: 116.295,
        openingHours: '10:00 - 22:00',
        coverImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
      });
    testRestaurantId = restRes.body.data.id;

    // 6. Create test Accommodation
    const accomRes = await request(app)
      .post('/api/v1/admin/accommodations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Status Test Resort ${testSuffix}`,
        type: 'Resort',
        description: 'Luxury seaside resort for testing status transitions.',
        pricePerNight: 1200000,
        address: 'Pantai Kuta, Lombok',
        region: 'LOMBOK_SELATAN',
        latitude: -8.891,
        longitude: 116.293,
        coverImageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      });
    testAccommodationId = accomRes.body.data.id;
  });

  describe('PATCH /api/v1/admin/destinations/:id/status', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${testDestinationId}/status`)
        .send({ status: 'DRAFT' });

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin users with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${testDestinationId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'DRAFT' });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should update destination status to DRAFT (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${testDestinationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DRAFT' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should update destination status to ARCHIVED and set deletedAt (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${testDestinationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ARCHIVED');
      expect(res.body.data.deletedAt).not.toBeNull();
    });

    it('should restore destination status to PUBLISHED and clear deletedAt (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${testDestinationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.deletedAt).toBeNull();
    });

    it('should reject invalid status with 400 Validation Error', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${testDestinationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'UNKNOWN_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/admin/categories/:id/status', () => {
    it('should update category status to DRAFT (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/categories/${testCategoryId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DRAFT' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should update category status to ARCHIVED (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/categories/${testCategoryId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ARCHIVED');
      expect(res.body.data.deletedAt).not.toBeNull();
    });

    it('should restore category status to PUBLISHED (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/categories/${testCategoryId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.deletedAt).toBeNull();
    });
  });

  describe('PATCH /api/v1/admin/restaurants/:id/status', () => {
    it('should update restaurant status to DRAFT (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/restaurants/${testRestaurantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DRAFT' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should update restaurant status to ARCHIVED (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/restaurants/${testRestaurantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ARCHIVED');
      expect(res.body.data.deletedAt).not.toBeNull();
    });

    it('should restore restaurant status to PUBLISHED (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/restaurants/${testRestaurantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.deletedAt).toBeNull();
    });
  });

  describe('PATCH /api/v1/admin/accommodations/:id/status', () => {
    it('should update accommodation status to DRAFT (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/accommodations/${testAccommodationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DRAFT' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should update accommodation status to ARCHIVED (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/accommodations/${testAccommodationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ARCHIVED');
      expect(res.body.data.deletedAt).not.toBeNull();
    });

    it('should restore accommodation status to PUBLISHED (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/accommodations/${testAccommodationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.deletedAt).toBeNull();
    });
  });
});
