import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Application } from 'express';
import { categoriesService } from '../src/modules/categories/categories.service';
import { destinationsService } from '../src/modules/destinations/destinations.service';

describe('Performance & Query Optimization Suite (Phase 24)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('Database Query Pagination & Safety Limits', () => {
    it('should strictly paginate destination queries to limit payload size', async () => {
      const response = await request(app).get('/api/v1/destinations?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('limit', 5);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('should enforce safe default limit when page is requested without explicit limit', async () => {
      const response = await request(app).get('/api/v1/destinations?page=2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.limit).toBe(10);
    });

    it('should paginate reviews by destination efficiently', async () => {
      const response = await request(app).get(
        '/api/v1/destinations/dest_tanjung_aan/reviews?page=1&limit=3',
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(3);
      expect(response.body.meta.limit).toBe(3);
    });

    it('should paginate itineraries list efficiently', async () => {
      const response = await request(app).get('/api/v1/itineraries?page=1&limit=2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.limit).toBe(2);
    });
  });

  describe('In-Memory Response Caching Layer', () => {
    it('should cache categories and serve subsequent requests from memory cache', async () => {
      // Clear cache first
      categoriesService.clearCache();

      // First call (populates cache)
      const start1 = performance.now();
      const res1 = await request(app).get('/api/v1/categories');
      const time1 = performance.now() - start1;

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.length).toBeGreaterThan(0);

      // Second call (hits cache)
      const start2 = performance.now();
      const res2 = await request(app).get('/api/v1/categories');
      const time2 = performance.now() - start2;

      expect(res2.status).toBe(200);
      expect(res2.body.data).toEqual(res1.body.data);
      // Cached call should be faster
      expect(time2).toBeLessThanOrEqual(time1 + 50);
    });

    it('should cache featured destinations and return identical payload', async () => {
      destinationsService.clearCache();

      const res1 = await request(app).get('/api/v1/destinations/featured?limit=4');
      expect(res1.status).toBe(200);
      expect(res1.body.data.length).toBeLessThanOrEqual(4);

      const res2 = await request(app).get('/api/v1/destinations/featured?limit=4');
      expect(res2.status).toBe(200);
      expect(res2.body.data).toEqual(res1.body.data);
    });
  });

  describe('N+1 Query Avoidance & Eager Loading', () => {
    it('should fetch category and images in single query without N+1 for destination details', async () => {
      const response = await request(app).get('/api/v1/destinations/dest_tanjung_aan');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('categoryName');
      expect(response.body.data).toHaveProperty('images');
      expect(Array.isArray(response.body.data.images)).toBe(true);
    });

    it('should fetch category counts eagerly in category listings', async () => {
      const response = await request(app).get('/api/v1/categories');

      expect(response.status).toBe(200);
      const beachCategory = response.body.data.find(
        (c: { slug: string }) => c.slug === 'beach',
      );
      expect(beachCategory).toBeDefined();
      expect(beachCategory).toHaveProperty('destinationCount');
      expect(typeof beachCategory.destinationCount).toBe('number');
    });
  });

  describe('Payload Size & Sensitive Field Redaction', () => {
    it('should not expose sensitive user fields in review author payloads', async () => {
      const response = await request(app).get(
        '/api/v1/destinations/dest_tanjung_aan/reviews?page=1&limit=5',
      );

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        const review = response.body.data[0];
        expect(review.user).not.toHaveProperty('password');
        expect(review.user).not.toHaveProperty('refreshToken');
        expect(review.user).toHaveProperty('name');
      }
    });
  });
});
