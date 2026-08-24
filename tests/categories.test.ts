import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('Categories API Module (Phase 9)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /v1/categories', () => {
    it('should return all categories with destination counts', async () => {
      const response = await request(app).get('/v1/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(13);

      const beach = response.body.data.find((c: any) => c.slug === 'beach');
      expect(beach).toBeDefined();
      expect(beach).toHaveProperty('destinationCount');
      expect(beach.destinationCount).toBeGreaterThan(0);
      expect(beach.name).toContain('Pantai');
    });
  });

  describe('GET /v1/categories/:id (Detail by Slug or UUID)', () => {
    it('should return category detail by slug (e.g. waterfall)', async () => {
      const response = await request(app).get('/v1/categories/waterfall');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('waterfall');
      expect(response.body.data.name).toContain('Air Terjun');
      expect(response.body.data).toHaveProperty('destinationCount');
    });

    it('should return category detail by UUID (e.g. cat_beach)', async () => {
      const response = await request(app).get('/v1/categories/cat_beach');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('cat_beach');
      expect(response.body.data.slug).toBe('beach');
    });

    it('should return 404 when category does not exist', async () => {
      const response = await request(app).get('/v1/categories/non-existent-category-xyz');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('CATEGORY_NOT_FOUND');
    });
  });

  describe('GET /v1/categories/:id/destinations', () => {
    it('should return paginated destinations under the category', async () => {
      const response = await request(app).get('/v1/categories/beach/destinations?page=1&limit=3');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(3);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 3,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });

      response.body.data.forEach((d: any) => {
        expect(d.categorySlug).toBe('beach');
      });
    });
  });
});
