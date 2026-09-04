import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Application } from 'express';

describe('Explore (Destinations, Accommodations, Restaurants) OpenAPI Documentation Module', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('1. Explore OpenAPI JSON & YAML Endpoints', () => {
    it('should serve Explore OpenAPI document in JSON format at /api/docs/explore/json (200 OK)', async () => {
      const res = await request(app).get('/api/docs/explore/json');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body).toHaveProperty('openapi', '3.0.3');
      expect(res.body.info.title).toContain('Destinations, Accommodations & Restaurants');

      // Verify essential tags
      const tagNames = res.body.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('Destinations');
      expect(tagNames).toContain('Accommodations');
      expect(tagNames).toContain('Restaurants & Culinary');
      expect(tagNames).toContain('Tourism Categories');

      // Verify essential paths
      expect(res.body.paths).toHaveProperty('/api/v1/destinations');
      expect(res.body.paths).toHaveProperty('/api/v1/destinations/featured');
      expect(res.body.paths).toHaveProperty('/api/v1/destinations/search');
      expect(res.body.paths).toHaveProperty('/api/v1/destinations/{id}');
      expect(res.body.paths).toHaveProperty('/api/v1/accommodations');
      expect(res.body.paths).toHaveProperty('/api/v1/accommodations/featured');
      expect(res.body.paths).toHaveProperty('/api/v1/accommodations/{id}');
      expect(res.body.paths).toHaveProperty('/api/v1/restaurants');
      expect(res.body.paths).toHaveProperty('/api/v1/restaurants/featured');
      expect(res.body.paths).toHaveProperty('/api/v1/restaurants/{id}');
    });

    it('should serve Explore OpenAPI document in YAML format at /api/docs/explore/yaml (200 OK)', async () => {
      const res = await request(app).get('/api/docs/explore/yaml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/yaml');
      expect(res.text).toContain('openapi: 3.0.3');
      expect(res.text).toContain('/api/v1/destinations:');
      expect(res.text).toContain('/api/v1/accommodations:');
      expect(res.text).toContain('/api/v1/restaurants:');
    });

    it('should serve Explore Swagger UI at /api/docs/explore/ (200 OK)', async () => {
      const res = await request(app).get('/api/docs/explore/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('2. Public Accommodations & Restaurants API Integration', () => {
    it('should list published accommodations via GET /api/v1/accommodations (200 OK)', async () => {
      const res = await request(app).get('/api/v1/accommodations?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
    });

    it('should list featured accommodations via GET /api/v1/accommodations/featured (200 OK)', async () => {
      const res = await request(app).get('/api/v1/accommodations/featured?limit=3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should list published restaurants via GET /api/v1/restaurants (200 OK)', async () => {
      const res = await request(app).get('/api/v1/restaurants?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
    });

    it('should list featured restaurants via GET /api/v1/restaurants/featured (200 OK)', async () => {
      const res = await request(app).get('/api/v1/restaurants/featured?limit=3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
