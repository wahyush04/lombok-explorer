import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';
import {
  createDestinationSchema,
  updateDestinationSchema,
  createCategorySchema,
  updateCategorySchema,
  updateUserSchema,
  reviewModerationSchema,
  paginationSchema,
  idParamSchema,
} from '../../src/modules/admin/validation/admin-validation.schemas';

describe('Admin Zod Validation Architecture Suite (Phase 15)', () => {
  let app: Application;
  let adminToken = '';
  let testDestinationId = '';
  let testReviewId = '';
  const testSuffix = Date.now();

  beforeAll(async () => {
    app = createApp();

    // 1. Login Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Create test category
    const catRes = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Validation Test Cat ${testSuffix}`,
        description: 'Testing validation layer',
        iconName: 'verified',
        status: 'PUBLISHED',
      });

    // 3. Create test destination
    const destRes = await request(app)
      .post('/api/v1/admin/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Validation Test Beach ${testSuffix}`,
        description: 'Test beach for Zod validation check.',
        categoryId: catRes.body.data.id,
        region: 'LOMBOK_SELATAN',
        locationName: 'South Lombok',
        latitude: -8.89,
        longitude: 116.29,
        status: 'PUBLISHED',
      });
    testDestinationId = destRes.body.data.id;

    // 4. Create user and submit review for moderation testing
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: `Reviewer ${testSuffix}`,
      email: `reviewer_${testSuffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    const userToken = userRes.body.data.accessToken;

    const reviewRes = await request(app)
      .post(`/api/v1/destinations/${testDestinationId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        rating: 5,
        content: 'Sensational location and breathtaking views!',
      });
    testReviewId = reviewRes.body.data.id;
  });

  describe('1. Zod Unit Validation Schemas Tests', () => {
    it('createDestinationSchema should validate valid input and reject invalid payload', () => {
      const valid = createDestinationSchema.safeParse({
        name: 'Tanjung Aan Beach',
        shortDescription: 'White pepper sand beach in Lombok',
        description: 'Tanjung Aan is famed for its distinctive pepper-like sand grains and turquoise bay.',
        categoryId: 'cat-123',
        region: 'LOMBOK_SELATAN',
        locationName: 'Pujut, Central Lombok',
        latitude: -8.91,
        longitude: 116.32,
      });
      expect(valid.success).toBe(true);

      const invalid = createDestinationSchema.safeParse({
        name: 'A', // Too short
        region: 'INVALID_REGION', // Invalid enum
        latitude: 999, // Out of range
      });
      expect(invalid.success).toBe(false);
    });

    it('updateDestinationSchema should allow partial fields', () => {
      const result = updateDestinationSchema.safeParse({
        name: 'Updated Name Only',
      });
      expect(result.success).toBe(true);
    });

    it('createCategorySchema should require name, description, and iconName', () => {
      const valid = createCategorySchema.safeParse({
        name: 'Pantai & Bahari',
        description: 'Wisata pantai dan kepulauan Lombok',
        iconName: 'beach_access',
      });
      expect(valid.success).toBe(true);

      const invalid = createCategorySchema.safeParse({
        name: '', // Empty
      });
      expect(invalid.success).toBe(false);
    });

    it('updateCategorySchema should allow partial update', () => {
      const result = updateCategorySchema.safeParse({
        description: 'New updated description',
      });
      expect(result.success).toBe(true);
    });

    it('updateUserSchema should validate valid role and status', () => {
      const valid = updateUserSchema.safeParse({
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      expect(valid.success).toBe(true);

      const invalid = updateUserSchema.safeParse({
        role: 'SUPER_HERO', // Invalid role
      });
      expect(invalid.success).toBe(false);
    });

    it('reviewModerationSchema should accept APPROVED, PENDING, REJECTED and reject unknown status', () => {
      const valid = reviewModerationSchema.safeParse({
        status: 'APPROVED',
        moderationNotes: 'Approved after verification',
      });
      expect(valid.success).toBe(true);

      const invalid = reviewModerationSchema.safeParse({
        status: 'UNAUTHORIZED_STATUS',
      });
      expect(invalid.success).toBe(false);
    });

    it('paginationSchema should enforce page >= 1 and limit <= 100', () => {
      const valid = paginationSchema.safeParse({
        page: 2,
        limit: 50,
      });
      expect(valid.success).toBe(true);

      const invalidLimit = paginationSchema.safeParse({
        limit: 500, // Exceeds max 100
      });
      expect(invalidLimit.success).toBe(false);
    });

    it('idParamSchema should reject empty id', () => {
      const valid = idParamSchema.safeParse({ id: 'valid-id' });
      expect(valid.success).toBe(true);

      const invalid = idParamSchema.safeParse({ id: '' });
      expect(invalid.success).toBe(false);
    });
  });

  describe('2. HTTP Request Zod Validation & Moderation Integration', () => {
    it('should reject POST /destinations with 400 when body fails Zod schema', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'X', // Invalid: min 2 chars
          region: 'INVALID_REGION',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should reject PUT /categories/:id with 400 when body fails Zod schema', async () => {
      const res = await request(app)
        .put('/api/v1/admin/categories/invalid-category-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Invalid: min 2 chars
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should list reviews via GET /api/v1/admin/reviews with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reviews?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('page', 1);
    });

    it('should reject PATCH /reviews/:id/moderate when status is invalid', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/reviews/${testReviewId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'INVALID_STATUS',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should successfully moderate review with PATCH /reviews/:id/moderate using valid Zod payload', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/reviews/${testReviewId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'APPROVED',
          moderationNotes: 'Approved by admin',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('should successfully delete review via DELETE /reviews/:id', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/reviews/${testReviewId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
