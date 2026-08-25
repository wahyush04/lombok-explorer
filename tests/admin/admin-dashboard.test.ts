import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Dashboard Statistics API Suite (Phase 3)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';

  beforeAll(async () => {
    app = createApp();

    // Login as Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Login as Standard User
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
  });

  describe('GET /api/v1/admin/dashboard', () => {
    it('should successfully return platform overview and analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Dashboard statistics retrieved successfully');

      // 1. Overview counts
      const overview = response.body.data.overview;
      expect(overview).toHaveProperty('totalUsers');
      expect(overview).toHaveProperty('totalDestinations');
      expect(overview).toHaveProperty('totalCategories');
      expect(overview).toHaveProperty('totalRestaurants');
      expect(overview).toHaveProperty('totalAccommodations');
      expect(overview).toHaveProperty('totalReviews');
      expect(overview).toHaveProperty('pendingReviews');
      expect(overview).toHaveProperty('totalItineraries');

      expect(overview.totalDestinations).toBeGreaterThanOrEqual(35);
      expect(overview.totalCategories).toBeGreaterThanOrEqual(13);
      expect(overview.totalRestaurants).toBeGreaterThanOrEqual(8);
      expect(overview.totalAccommodations).toBeGreaterThanOrEqual(7);

      // 2. Periodic metrics
      const periodic = response.body.data.periodicMetrics;
      expect(periodic).toHaveProperty('newUsers');
      expect(periodic).toHaveProperty('newReviews');
      expect(periodic).toHaveProperty('newItineraries');
      expect(periodic.dateRange).toEqual({ startDate: null, endDate: null });

      // 3. Highlights
      const highlights = response.body.data.highlights;
      expect(highlights).toHaveProperty('popularDestinations');
      expect(highlights).toHaveProperty('mostFavoritedDestinations');
      expect(Array.isArray(highlights.popularDestinations)).toBe(true);
      expect(Array.isArray(highlights.mostFavoritedDestinations)).toBe(true);

      if (highlights.popularDestinations.length > 0) {
        const topDest = highlights.popularDestinations[0];
        expect(topDest).toHaveProperty('id');
        expect(topDest).toHaveProperty('name');
        expect(topDest).toHaveProperty('slug');
        expect(topDest).toHaveProperty('region');
        expect(topDest).toHaveProperty('rating');
        expect(topDest).toHaveProperty('reviewCount');
        expect(topDest).toHaveProperty('coverImageUrl');
      }
    });

    it('should support date range filtering (?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD)', async () => {
      const response = await request(app)
        .get('/api/v1/admin/dashboard?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.periodicMetrics.dateRange.startDate).toContain('2026-01-01');
      expect(response.body.data.periodicMetrics.dateRange.endDate).toContain('2026-12-31');
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const response = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const response = await request(app).get('/api/v1/admin/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });
  });
});
